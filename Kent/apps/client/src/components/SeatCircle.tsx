import type { ReactNode } from "react";

export interface SeatCircleProps {
  seatCount: number;
  renderSeat: (seat: number) => ReactNode;
  /** Seat to anchor at the bottom (typically the viewer's own seat) so the table always orients around "you". */
  anchorSeat?: number;
  radiusPct?: number;
  maxWidthPx?: number;
}

export function SeatCircle({ seatCount, renderSeat, anchorSeat = 0, radiusPct = 42, maxWidthPx = 560 }: SeatCircleProps) {
  return (
    <div className="relative mx-auto aspect-square w-full" style={{ maxWidth: maxWidthPx }}>
      {Array.from({ length: seatCount }, (_, seat) => {
        const relPos = (seat - anchorSeat + seatCount) % seatCount;
        const angle = Math.PI / 2 + (relPos * 2 * Math.PI) / seatCount;
        const x = 50 + radiusPct * Math.cos(angle);
        const y = 50 + radiusPct * Math.sin(angle);
        return (
          <div key={seat} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
            {renderSeat(seat)}
          </div>
        );
      })}
    </div>
  );
}
