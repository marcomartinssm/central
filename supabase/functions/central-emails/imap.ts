// Cliente IMAP mínimo (só leitura) usando Deno.connectTls.
export class Imap {
  private conn!: Deno.TlsConn; private buf = new Uint8Array(0); private tag = 0;
  private dec = new TextDecoder("latin1"); private enc = new TextEncoder();
  constructor(private host: string, private port = 993) {}
  async abrir() { this.conn = await Deno.connectTls({ hostname: this.host, port: this.port }); await this.linha(); }
  private async ler() { const b = new Uint8Array(65536); const n = await this.conn.read(b); if (n === null) throw new Error("conexão fechada"); const nb = new Uint8Array(this.buf.length + n); nb.set(this.buf); nb.set(b.subarray(0, n), this.buf.length); this.buf = nb; }
  private async linha(): Promise<string> {
    while (true) { const i = this.buf.indexOf(10); if (i >= 0) { const l = this.dec.decode(this.buf.subarray(0, i + 1)); this.buf = this.buf.slice(i + 1); return l.replace(/\r?\n$/, ""); } await this.ler(); }
  }
  private async bytes(n: number): Promise<Uint8Array> { while (this.buf.length < n) await this.ler(); const r = this.buf.slice(0, n); this.buf = this.buf.slice(n); return r; }
  // envia comando; devolve linhas e literais {n}
  async cmd(c: string): Promise<{ ok: boolean; texto: string; linhas: string[]; literais: Uint8Array[] }> {
    const t = "A" + (++this.tag); await this.conn.write(this.enc.encode(`${t} ${c}\r\n`));
    const linhas: string[] = [], literais: Uint8Array[] = [];
    while (true) {
      const l = await this.linha();
      const m = l.match(/\{(\d+)\}$/);
      if (m) { linhas.push(l); literais.push(await this.bytes(Number(m[1]))); continue; }
      if (l.startsWith(t + " ")) return { ok: l.startsWith(t + " OK"), texto: l.slice(t.length + 1), linhas, literais };
      linhas.push(l);
    }
  }
  static q(s: string) { return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'; }
  async login(u: string, p: string) { const r = await this.cmd(`LOGIN ${Imap.q(u)} ${Imap.q(p)}`); if (!r.ok) throw new Error("login recusado: " + r.texto); }
  fechar() { try { this.conn.close(); } catch { /* */ } }
}
