import winston from "winston";
import path from "path";
import fs from "fs"

const logDir = '../../logs'
if(!fs.existsSync(logDir)) fs.mkdirSync(logDir)

export function createLogger(serviceName) {
  const serviceFile = path.join(logDir, `${serviceName}.log`);

  return winston.createLogger({
    level: "info",
    format: winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] [${serviceName.toUpperCase()}] ${level.toUpperCase()}: ${message}`;
      })
    ),
    transports: [
      // Console output for development
      new winston.transports.Console(),
      // Service-specific log file
      new winston.transports.File({ filename: serviceFile }),
      // Global error log
      new winston.transports.File({ filename: path.join(logDir, "errors.log"), level: "error" }),
    ],
  });
}
