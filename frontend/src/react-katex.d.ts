declare module 'react-katex' {
  import * as React from 'react';

  export interface InlineMathProps {
    math: string;
    settings?: {
      throwOnError?: boolean;
      strict?: boolean;
      [key: string]: unknown;
    };
  }

  export interface BlockMathProps {
    math: string;
    settings?: {
      throwOnError?: boolean;
      strict?: boolean;
      [key: string]: unknown;
    };
  }

  export class InlineMath extends React.Component<InlineMathProps> {}
  export class BlockMath extends React.Component<BlockMathProps> {}
}
