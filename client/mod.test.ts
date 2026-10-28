import { decrypt, encrypt } from "./mod.ts";
import { decodeBase64 } from "@std/encoding/base64";
import { extract_usk } from "../lib/rs_lib.js";
import { assertEquals } from "@std/assert/equals";

class Server {
  mpk: Uint8Array;
  sk: Uint8Array;
  constructor() {
    this.mpk = decodeBase64(
      "lnjPgKBFzd7iT9wCrlYlBT8cP3cQBxxZlCFfRyJgffmgvxYVuhpNBSfIGuKYjBGDt+oDDzlFc5Sv6UnU9d+KdButy/8lSwbZM8ZZ0C/iAqHu/+6+PndPwhSHRTufCwWRoDSa5Go6eD8rdY2Cfnn0v54Vz6vLU0lDrKNTtluonerrbu/RkYo/hI+S8kYOktN+opcSlOcE3hUJKtEDawz8zUQhilMO44m1R2dhNB3zi4zzMyeTnN9tfXpl8jWHzuXnsjDXpSxX9tMfnoP/uhyD5E1EtdwFmF6tPLoU3PAehH+wKdytW+1EaucP3SlWluNHpvGBUKzmlXE8X4Mzo4ocKjYUvyxWGlCNnMY9RiWuh3/9i7HURgLmIoAg/+d3xpjEoW46kxPKz1m9T/U91kKEflQ/lo+ligdIu5xhsEzTjF352q48SO1F5LfbapqUlUapjy+EizJbNpdWC2+L1hOoV6/cLMUaGz/ysglxPlEr8fjLzjSTfxx6ZsOA5IIs3lKniqyEQO8BE9metl02llCE6jXtBAEMzKdDbYX1eL+lpGqmHMwnthg69peSjs4p4GFBCwcKncdMJ+PlT87bINgS8w3gMnTl97OmbmfYgZGpFtxCaUCN/LCXr48IvFXrzijIAPG8CGUeV+qWC/jJSZEfDaC94VNqpqCXhll3wj1leQKwLSQCA4tpSQKcR8ZaQZvnBG9wEDecHN8C0XpXeyQFsZT8G5D66DPWkRN9/8dmrEi0u811vNi7gpnqmwLJ+OxUCThwZMdiYlhrNZfmXRwuO+eWzdGB35h7rECerszgEH8eYuYHW0pz99EZBG5Y8gNFGTeeVkfJ9CreLX21TnXk+F6WZ9euQGpubPDRvORmpfQ1uVxuEj6/IUChrNxYFU2P",
    );
    this.sk = decodeBase64(
      "rEoPT+sPblenZfpFaLoQxWPSR7MBPL6MI14+ZBU482DOkHkeU/mjw+xTsx8n1Zx37SQK54UFVMrx1HTkgEPVBIcRLL3lhJAhih9Lc3tHbdecsOasIIaF+UX/9CPVL9lgJdLApSGe0WZi5rnhXFP5X/p8okCQx5SBiAIvQwWpGyc/Gje2polXlS0Eac8khd6gIDaMKGnw+qUPerklLRvAVT4nqeW1pr3IXeRrXGdlTgGZs0eIUYo4eQfw9NGv85hSG5NB7iMyuoA2XXLySDzrDP/sPne5vzkYJkYNf0fUKiPoedPOb0liLeH6dhbCESPVaYpXOnmfFX4w4asEZX4gchYvZVhpeJO8jBQgTrM9RUIPYxudbqeghkSeSkXbsFc7d+3Yvud6Qgi5qz4AJFF3VaUUuKqmIpf6aBJc1wep0zAsnaMPjO/wTUiKTs+UKCHGUIRXP/qh77UCyPAKRYL3CA8Meq6gBAoVnUzq1rHHqqYjDLNiPce/NjtgqsifnzYtMM3jnEcPD39vCW6OEyB+Rhhb1z0S5Tq7oY42SGqmih01YVpyjPubS5j+BieUO8zi8bPRgw5U7UgrI+XFAu9wHYqdoEYPw1TMvf8WMO/B65kwHGKcQ4knDJJ5bp1ABrNfHdMNUttJp8pNyG8Y/sakMnoqEpjs95mPDBtPIc+K2zw=",
    );
  }
  usk(id: string) {
    return extract_usk(this.sk, id);
  }
}
Deno.test({
  name: "encrypt and decrypt",
  fn: async () => {
    const server = new Server();
    const plain: Uint8Array = crypto.getRandomValues(new Uint8Array(256));
    const id = "test";
    const enc = await encrypt(server.mpk, id, plain);
    const usk = await server.usk(id);
    const dec = await decrypt(usk, enc);
    assertEquals(plain, new Uint8Array(dec));
  },
});
