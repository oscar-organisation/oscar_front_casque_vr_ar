/** Pure desktop input mapping shared by the browser publisher and its tests. */

const DEADMAN_GAMEPAD_BUTTONS = [4, 5, 6, 7, 0];

export function readKeyboardInput(pressedKeys) {
  const forward = hasAny(pressedKeys, 'ArrowUp', 'KeyW');
  const backward = hasAny(pressedKeys, 'ArrowDown', 'KeyS');
  const turnLeft = hasAny(pressedKeys, 'ArrowLeft', 'KeyA');
  const turnRight = hasAny(pressedKeys, 'ArrowRight', 'KeyD');
  const strafeLeft = pressedKeys.has('KeyQ');
  const strafeRight = pressedKeys.has('KeyE');

  return {
    source: 'desktop-keyboard',
    deadman: hasAny(pressedKeys, 'Space', 'ShiftLeft', 'ShiftRight'),
    leftX: Number(strafeLeft) - Number(strafeRight),
    // Isaac's shared mapping inverts left Y: -1 means forward on the wire.
    leftY: Number(backward) - Number(forward),
    rightX: Number(turnRight) - Number(turnLeft),
  };
}

export function readGamepadInput(gamepads) {
  const gamepad = Array.from(gamepads || []).find((candidate) => candidate?.connected);
  if (!gamepad) return null;

  const axes = Array.from(gamepad.axes || [], clampAxis);
  const buttons = Array.from(gamepad.buttons || [], buttonToPacket);

  return {
    source: 'desktop-gamepad',
    deadman: DEADMAN_GAMEPAD_BUTTONS.some((index) => buttonActive(gamepad.buttons?.[index])),
    leftX: axes[0] || 0,
    leftY: axes[1] || 0,
    rightX: axes[2] || 0,
    gamepad: {
      id: gamepad.id || 'unknown-gamepad',
      mapping: gamepad.mapping || '',
      axes,
      buttons,
    },
  };
}

export function buildControllers(leftX, leftY, rightX, deadman, gamepad = null) {
  const released = { p: false, t: false, v: 0 };
  const held = { p: deadman, t: deadman, v: deadman ? 1 : 0 };
  const rightY = clampAxis(gamepad?.axes?.[3]);
  return [
    {
      hand: 'left',
      mode: 'desktop',
      axes: [leftX, leftY],
      buttons: [released, held],
      gamepad,
      target: null,
      grip: null,
    },
    {
      hand: 'right',
      mode: 'desktop',
      axes: [rightX, rightY],
      buttons: [released, held],
      target: null,
      grip: null,
    },
  ];
}

function hasAny(values, ...candidates) {
  return candidates.some((candidate) => values.has(candidate));
}

function buttonActive(button) {
  return !!button && (button.pressed || Number(button.value || 0) >= 0.5);
}

function buttonToPacket(button) {
  return {
    p: !!button?.pressed,
    t: !!button?.touched,
    v: Math.max(0, Math.min(1, Number(button?.value || 0))),
  };
}

function clampAxis(value) {
  const number = Number(value || 0);
  return Math.max(-1, Math.min(1, number));
}
