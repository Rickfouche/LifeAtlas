import type { AtlasWorldState } from "@/types/atlas";

type AtlasWorldStyle = {
  landColor: string;
  landOpacity: number;
  borderOpacity: number;
  edgeOpacity: number;
};

export const atlasModeStyles: Record<
  AtlasWorldState,
  AtlasWorldStyle
> = {
  all: {
    landColor: "#087ea4",
    landOpacity: 0.72,
    borderOpacity: 0.28,
    edgeOpacity: 0.34,
  },

  past: {
    landColor: "#0b5270",
    landOpacity: 0.42,
    borderOpacity: 0.16,
    edgeOpacity: 0.15,
  },

  present: {
    landColor: "#087ea4",
    landOpacity: 0.78,
    borderOpacity: 0.34,
    edgeOpacity: 0.38,
  },

  future: {
    landColor: "#00bfff",
    landOpacity: 0.95,
    borderOpacity: 0.58,
    edgeOpacity: 0.68,
  },
};