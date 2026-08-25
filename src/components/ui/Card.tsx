import type { ReactNode } from 'react';
import { cardClass, type CardPadding } from './cardClass';

/** Tenký `div` nad `cardClass` pro pasivní panely. Klikací karty berou `cardClass()` přímo. */
export default function Card({
  padding,
  interactive,
  className,
  children,
}: {
  padding?: CardPadding;
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return <div className={cardClass({ padding, interactive, className })}>{children}</div>;
}
