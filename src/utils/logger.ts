function createPrint(print: (...args: any[]) => void) {
  return (...args: any[]) => {
    const prefix = "%cPBE%c▶";
    const styles = [
      "color: white; padding-left: 4px; font-weight: bold;",
      "color: rgb(26, 115, 232);",
    ];
    print(prefix, ...styles, ...args);
  };
}

export const logger = {
  debug: createPrint(console.debug),
  info: createPrint(console.info),
  warn: createPrint(console.warn),
  error: createPrint(console.error),
};
