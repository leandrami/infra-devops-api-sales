export class ExportService {
  /**
   * Simula a geração de um relatório massivo de ingressos vendidos.
   * Propositalmente consome CPU e Memória para simular gargalos.
   */
  async generateMassiveReport(recordsCount: number = 1000000): Promise<string> {
    const memoryHog: string[] = [];
    
    // Simula processamento pesado de string e alocação de memória
    for (let i = 0; i < recordsCount; i++) {
      const record = `TICKET_EXPORT_RECORD_ID_${i}_TIME_${Date.now()}_SOME_EXTRA_DATA_TO_CONSUME_MEMORY`;
      memoryHog.push(record);
      
      // Pequeno "spin" para gastar CPU
      if (i % 1000 === 0) {
        let cpuBurn = 0;
        for (let j = 0; j < 1000; j++) {
          cpuBurn += Math.sqrt(j);
        }
      }
    }

    // Retorna um buffer simulando um CSV (tamanho gigantesco)
    return memoryHog.join("\\n");
  }
}
