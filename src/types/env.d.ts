declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_DEBUG_MODE?: string;
    DEBUG_MODE?: string;
    [key: string]: string | undefined;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
