declare global {
  namespace Express {
    interface Request {
      user?: any;
      tenant?: any;
      supportSession?: any;
    }
  }
}
export {};
