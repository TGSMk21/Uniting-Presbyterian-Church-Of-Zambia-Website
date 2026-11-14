// Gesture maths, from the apple-design skill (Apple's "Designing Fluid Interfaces").

// Where a flick would come to rest, given its speed in px/s (exponential deceleration).
export function project(velocity, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

// Pulling past an edge: the further past, the less the element follows.
export function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

// A sheet closes if, going by where the gesture was heading, it would end up more than
// halfway down, unless the finger was clearly flicking it back up.
export function sheetShouldClose({ offset, velocity, height }) {
  if (velocity < -300) return false;
  return offset + project(velocity) > height * 0.4;
}
