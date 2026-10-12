// Build-time switches. Off in a normal build. Values are inlined by the compiler.
export const KB = {
  b01: process.env.NEXT_PUBLIC_KB_01 === "1",
  b02: process.env.NEXT_PUBLIC_KB_02 === "1",
  b03: process.env.NEXT_PUBLIC_KB_03 === "1",
  b04: process.env.NEXT_PUBLIC_KB_04 === "1",
  b05: process.env.NEXT_PUBLIC_KB_05 === "1",
  b06: process.env.NEXT_PUBLIC_KB_06 === "1",
  b07: process.env.NEXT_PUBLIC_KB_07 === "1",
  b08: process.env.NEXT_PUBLIC_KB_08 === "1",
  b09: process.env.NEXT_PUBLIC_KB_09 === "1",
  b10: process.env.NEXT_PUBLIC_KB_10 === "1",
  b11: process.env.NEXT_PUBLIC_KB_11 === "1",
  b12: process.env.NEXT_PUBLIC_KB_12 === "1",
} as const;
