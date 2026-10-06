import { Request, Response } from "express";
import { ExportService } from "../services/ExportService";

export class ExportController {
  private exportService = new ExportService();

  async handle(req: Request, res: Response): Promise<Response> {
    const recordsCount = req.body.records || 500000; // Ajustável para não travar de imediato se não quiser
    
    // Isso vai bloquear o event loop (intencional conforme requisito)
    const reportData = await this.exportService.generateMassiveReport(recordsCount);

    return res.status(200).json({
      message: "Export completed",
      sizeInBytes: Buffer.byteLength(reportData, "utf8")
    });
  }
}
