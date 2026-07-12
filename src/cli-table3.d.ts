declare module 'cli-table3' {
  interface TableOptions {
    head?: Array<string | { content: string; hAlign?: string }>;
    style?: {
      head?: string[];
      border?: string[];
    };
  }

  class Table extends Array<any> {
    constructor(options?: TableOptions);
    push(...rows: any[][]): number;
    toString(): string;
  }

  export = Table;
}
