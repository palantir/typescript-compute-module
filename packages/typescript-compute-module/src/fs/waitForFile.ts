import fs from "fs";
import path from "path";

export function waitForJsonFile<T>(filePath: string): Promise<T> {
  return waitForFile(filePath).then((content) => JSON.parse(content));
}

export function waitForFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const readFileAndResolve = () => {
      fs.readFile(filePath, "utf8", (err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data);
      });
    };

    // Check if the file already exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (!err) {
        return readFileAndResolve();
      }

      const directory = path.dirname(filePath);
      const fileName = path.basename(filePath);

      const watcher = fs.watch(directory, (eventType, changedFileName) => {
        if (eventType === "rename" && changedFileName === fileName) {
          watcher.close();
          readFileAndResolve();
        }
      });

      watcher.on("error", (err) => {
        watcher.close();
        reject(err);
      });
    });
  });
}
