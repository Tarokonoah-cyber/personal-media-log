export type ScrollPositionSnapshot = {
  element: HTMLElement;
  top: number;
  left: number;
};

export function captureScrollPositions(elements: Array<HTMLElement | null>): ScrollPositionSnapshot[] {
  return elements.flatMap((element) => element ? [{
    element,
    top: element.scrollTop,
    left: element.scrollLeft
  }] : []);
}

export function restoreScrollPositions(
  snapshots: ScrollPositionSnapshot[],
  schedule: (callback: FrameRequestCallback) => number = window.requestAnimationFrame.bind(window)
) {
  schedule(() => {
    for (const snapshot of snapshots) {
      if (!snapshot.element.isConnected) continue;
      snapshot.element.scrollTop = snapshot.top;
      snapshot.element.scrollLeft = snapshot.left;
    }
  });
}
