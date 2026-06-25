/**
 * Physics and raycasting engine for the differential-drive robot car in a 3D room.
 * The room floor lies on the X-Z plane. Y is the vertical axis.
 */

export const ROBOT_GEOMETRY = {
  radius: 0.25, // meters
  wheelTrack: 0.4, // distance between wheels, meters
  wheelRadius: 0.08, // meters
  sensorOffset: 0.22, // sensor position relative to center along forward vector, meters
  maxSensorRange: 4.0, // max ultrasonic sensor range, meters (400 cm)
  maxSpeed: 1.5, // meters per second max speed at 1.0 motor power
};

/**
 * Perform 2D raycast on X-Z plane against walls and circular/rectangular obstacles.
 * Ray origin: (ox, oz), direction vector: (dx, dz)
 */
function raycastObstacles(ox, oz, dx, dz, obstacles, roomWidth, roomDepth) {
  let minT = ROBOT_GEOMETRY.maxSensorRange;

  // 1. Raycast against room boundary walls
  const halfW = roomWidth / 2;
  const halfD = roomDepth / 2;

  // Wall boundaries: X = -halfW, X = halfW, Z = -halfD, Z = halfD
  // Equation: ox + t * dx = X  =>  t = (X - ox) / dx
  if (Math.abs(dx) > 1e-6) {
    // Left Wall (X = -halfW)
    let t = (-halfW - ox) / dx;
    if (t > 0 && t < minT) {
      const zIntersect = oz + t * dz;
      if (zIntersect >= -halfD && zIntersect <= halfD) minT = t;
    }
    // Right Wall (X = halfW)
    t = (halfW - ox) / dx;
    if (t > 0 && t < minT) {
      const zIntersect = oz + t * dz;
      if (zIntersect >= -halfD && zIntersect <= halfD) minT = t;
    }
  }

  // Z walls
  if (Math.abs(dz) > 1e-6) {
    // Bottom Wall (Z = -halfD)
    let t = (-halfD - oz) / dz;
    if (t > 0 && t < minT) {
      const xIntersect = ox + t * dx;
      if (xIntersect >= -halfW && xIntersect <= halfW) minT = t;
    }
    // Top Wall (Z = halfD)
    t = (halfD - oz) / dz;
    if (t > 0 && t < minT) {
      const xIntersect = ox + t * dx;
      if (xIntersect >= -halfW && xIntersect <= halfW) minT = t;
    }
  }

  // 2. Raycast against obstacles
  for (const obs of obstacles) {
    if (obs.type === 'cylinder' || obs.type === 'toy') {
      // Ray-circle intersection
      // Circle at (obs.x, obs.z) with radius obs.radius
      const cx = obs.x;
      const cz = obs.z;
      const r = obs.radius || 0.3;

      const sx = ox - cx;
      const sz = oz - cz;

      // Quadratic terms: a*t^2 + 2*b*t + c = 0
      // Since direction (dx, dz) is normalized, a = dx^2 + dz^2 = 1
      const b = sx * dx + sz * dz;
      const c = sx * sx + sz * sz - r * r;

      const discriminant = b * b - c;
      if (discriminant >= 0) {
        const sqrtDisc = Math.sqrt(discriminant);
        let t1 = -b - sqrtDisc;
        let t2 = -b + sqrtDisc;

        if (t1 > 0 && t1 < minT) minT = t1;
        else if (t2 > 0 && t2 < minT) minT = t2;
      }
    } else if (obs.type === 'box' || obs.type === 'chair') {
      // Simplified Ray-box intersection (Axis Aligned in X-Z)
      const hx = (obs.width || 0.6) / 2;
      const hz = (obs.depth || 0.6) / 2;
      const minX = obs.x - hx;
      const maxX = obs.x + hx;
      const minZ = obs.z - hz;
      const maxZ = obs.z + hz;

      let tMin = 0;
      let tMax = minT;

      // X bounds
      if (Math.abs(dx) < 1e-6) {
        if (ox < minX || ox > maxX) continue; // Ray parallel and outside
      } else {
        const invDx = 1.0 / dx;
        let t1 = (minX - ox) * invDx;
        let t2 = (maxX - ox) * invDx;
        if (t1 > t2) { const temp = t1; t1 = t2; t2 = temp; }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) continue;
      }

      // Z bounds
      if (Math.abs(dz) < 1e-6) {
        if (oz < minZ || oz > maxZ) continue; // Ray parallel and outside
      } else {
        const invDz = 1.0 / dz;
        let t1 = (minZ - oz) * invDz;
        let t2 = (maxZ - oz) * invDz;
        if (t1 > t2) { const temp = t1; t1 = t2; t2 = temp; }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) continue;
      }

      if (tMin > 0 && tMin < minT) {
        minT = tMin;
      }
    }
  }

  return minT;
}

/**
 * Resolves robot-obstacle and robot-wall collisions.
 * Returns updated position and collision status.
 */
function resolveCollisions(x, z, obstacles, roomWidth, roomDepth) {
  let collided = false;
  let rx = x;
  let rz = z;
  const rad = ROBOT_GEOMETRY.radius;

  // 1. Keep within room boundaries
  const limitX = roomWidth / 2 - rad;
  const limitZ = roomDepth / 2 - rad;

  if (rx < -limitX) { rx = -limitX; collided = true; }
  if (rx > limitX) { rx = limitX; collided = true; }
  if (rz < -limitZ) { rz = -limitZ; collided = true; }
  if (rz > limitZ) { rz = limitZ; collided = true; }

  // 2. Push away from obstacles
  for (const obs of obstacles) {
    if (obs.type === 'cylinder' || obs.type === 'toy') {
      const cx = obs.x;
      const cz = obs.z;
      const obsRad = obs.radius || 0.3;
      const minDist = rad + obsRad;

      const dx = rx - cx;
      const dz = rz - cz;
      const distSq = dx * dx + dz * dz;

      if (distSq < minDist * minDist) {
        collided = true;
        const dist = Math.sqrt(distSq);
        if (dist > 1e-6) {
          // Push out along normal
          rx = cx + (dx / dist) * minDist;
          rz = cz + (dz / dist) * minDist;
        } else {
          // Exactly on top, push randomly
          rx += minDist;
        }
      }
    } else if (obs.type === 'box' || obs.type === 'chair') {
      // Box collision check
      const hx = (obs.width || 0.6) / 2;
      const hz = (obs.depth || 0.6) / 2;
      
      // Find closest point on box to robot center
      const closestX = Math.max(obs.x - hx, Math.min(rx, obs.x + hx));
      const closestZ = Math.max(obs.z - hz, Math.min(rz, obs.z + hz));

      const dx = rx - closestX;
      const dz = rz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < rad * rad) {
        collided = true;
        const dist = Math.sqrt(distSq);
        if (dist > 1e-6) {
          rx = closestX + (dx / dist) * rad;
          rz = closestZ + (dz / dist) * rad;
        } else {
          // Robot center is inside the box, push out along the shallowest dimension
          const overlapX = hx - Math.abs(rx - obs.x);
          const overlapZ = hz - Math.abs(rz - obs.z);
          if (overlapX < overlapZ) {
            rx += (rx > obs.x ? rad + hx : -(rad + hx));
          } else {
            rz += (rz > obs.z ? rad + hz : -(rad + hz));
          }
        }
      }
    }
  }

  return { x: rx, z: rz, collided };
}

export const robotPhysics = {
  /**
   * Run one physics tick step
   */
  tick(robotState, leftMotorPower, rightMotorPower, obstacles, roomWidth, roomDepth, dt) {
    // 1. Calculate target wheel speeds from motor powers (-1.0 to 1.0)
    const targetLeftSpeed = leftMotorPower * ROBOT_GEOMETRY.maxSpeed;
    const targetRightSpeed = rightMotorPower * ROBOT_GEOMETRY.maxSpeed;

    // Apply motor inertia/acceleration
    const accelRate = 5.0; // speed change rate per second
    const leftSpeed = robotState.leftSpeed + (targetLeftSpeed - robotState.leftSpeed) * Math.min(1.0, accelRate * dt);
    const rightSpeed = robotState.rightSpeed + (targetRightSpeed - robotState.rightSpeed) * Math.min(1.0, accelRate * dt);

    // 2. Solve kinematics
    const linearVelocity = (leftSpeed + rightSpeed) / 2.0;
    const angularVelocity = (rightSpeed - leftSpeed) / ROBOT_GEOMETRY.wheelTrack;

    // Update orientation (angle in radians)
    let angle = robotState.angle + angularVelocity * dt;
    // Keep angle normalized between -PI and PI
    angle = Math.atan2(Math.sin(angle), Math.cos(angle));

    // Update position
    let x = robotState.x + linearVelocity * Math.cos(angle) * dt;
    let z = robotState.z + linearVelocity * Math.sin(angle) * dt;

    // 3. Resolve collisions
    const collisionResult = resolveCollisions(x, z, obstacles, roomWidth, roomDepth);
    x = collisionResult.x;
    z = collisionResult.z;
    const collided = collisionResult.collided;

    // 4. Update wheel rotations for visual animation
    const dLeftRot = (leftSpeed * dt) / ROBOT_GEOMETRY.wheelRadius;
    const dRightRot = (rightSpeed * dt) / ROBOT_GEOMETRY.wheelRadius;
    const leftWheelRotation = (robotState.leftWheelRotation || 0) + dLeftRot;
    const rightWheelRotation = (robotState.rightWheelRotation || 0) + dRightRot;

    // 5. Measure distance sensor
    // Sensor is offset from center along the forward heading
    const sensorX = x + ROBOT_GEOMETRY.sensorOffset * Math.cos(angle);
    const sensorZ = z + ROBOT_GEOMETRY.sensorOffset * Math.sin(angle);
    
    // Heading vector
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);

    const distanceT = raycastObstacles(sensorX, sensorZ, dirX, dirZ, obstacles, roomWidth, roomDepth);
    // distance in centimeters
    const sensorDistance = distanceT * 100;

    return {
      x,
      y: 0.1, // Fixed height off floor
      z,
      angle,
      leftSpeed,
      rightSpeed,
      leftWheelRotation,
      rightWheelRotation,
      sensorDistance,
      sensorX,
      sensorZ,
      collided
    };
  },

  /**
   * Get an initial robot state
   */
  getInitialState(startX = 0, startZ = 0, startAngle = 0) {
    return {
      x: startX,
      y: 0.1,
      z: startZ,
      angle: startAngle,
      leftSpeed: 0,
      rightSpeed: 0,
      leftWheelRotation: 0,
      rightWheelRotation: 0,
      sensorDistance: ROBOT_GEOMETRY.maxSensorRange * 100,
      sensorX: startX + ROBOT_GEOMETRY.sensorOffset * Math.cos(startAngle),
      sensorZ: startZ + ROBOT_GEOMETRY.sensorOffset * Math.sin(startAngle),
      collided: false
    };
  }
};
