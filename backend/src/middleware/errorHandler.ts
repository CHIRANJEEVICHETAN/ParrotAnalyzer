import { Request, Response, NextFunction } from 'express';

export const errorLogger = (error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error details:', {
    message: error.message,
    stack: error.stack,
    query: error.query,
    params: req.params,
    body: req.body
  });
  next(error);
};

export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
}; 