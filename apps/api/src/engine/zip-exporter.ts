import { ZipArchive } from "archiver";
import type { AppConfig } from "@genstack/config-types";
import { generateStandaloneProject } from "./github-exporter.js";

export async function exportProjectAsZip(config: AppConfig): Promise<Buffer> {
  const files = generateStandaloneProject(config);

  return new Promise<Buffer>((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const buffers: Buffer[] = [];

    archive.on("data", (data: Buffer) => buffers.push(data));
    archive.on("end", () => resolve(Buffer.concat(buffers)));
    archive.on("error", (error: Error) => reject(error));

    for (const [path, content] of Object.entries(files)) {
      archive.append(content, { name: path });
    }

    archive.finalize().catch(reject);
  });
}
