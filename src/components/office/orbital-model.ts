import type { AgentId } from "@/lib/office/schema";
export const crew: {
  id: AgentId;
  name: string;
  code: string;
  accent: string;
  line: string;
  specialty: string;
}[] = [
  {
    id: "hermes",
    name: "Hermes",
    code: "H-01",
    accent: "#d3dfde",
    specialty: "COMANDO",
    line: "Tripulação em sintonia. Qual é o próximo destino?",
  },
  {
    id: "vega",
    name: "Vega",
    code: "V-02",
    accent: "#e7b45e",
    specialty: "ANÁLISE",
    line: "Primeiro os números. Depois, uma decisão com margem de segurança.",
  },
  {
    id: "sirius",
    name: "Sirius",
    code: "S-03",
    accent: "#6dbbd2",
    specialty: "OPERAÇÕES",
    line: "Vamos transformar esse projeto em um próximo passo concreto.",
  },
  {
    id: "orion",
    name: "Órion",
    code: "O-04",
    accent: "#a8c68c",
    specialty: "BIOSSISTEMAS",
    line: "Uma pausa, água e movimento. A missão também depende de você.",
  },
  {
    id: "astro",
    name: "Astro",
    code: "A-05",
    accent: "#b7a7d2",
    specialty: "OBSERVATÓRIO",
    line: "Vamos olhar por outro ângulo. Há uma pergunta boa aqui.",
  },
  {
    id: "cosmo",
    name: "Cosmo",
    code: "C-06",
    accent: "#e9946c",
    specialty: "LABORATÓRIO",
    line: "Tenho uma ideia: encontrar uma forma inesperada de contar isso.",
  },
  {
    id: "antares",
    name: "Antares",
    code: "AN-07",
    accent: "#df6f65",
    specialty: "COMERCIAL",
    line: "Primeiro a evidência. Depois, uma boa conversa e um próximo passo.",
  },
];
export function stationAngle(index: number): number {
  return (index * Math.PI * 2) / crew.length + Math.PI / 6;
}
export function stationPoint(
  index: number,
  radius = 5.7,
): [number, number, number] {
  const angle = stationAngle(index);
  return [Math.sin(angle) * radius, 0, Math.cos(angle) * radius];
}
// Decorative choreography only. Real runs always stay at their operational station.
export function robotPose(
  index: number,
  time: number,
  meeting: boolean,
  working: boolean,
) {
  const phase = (time + index * 3.1) % 34;
  const visiting = !working && (meeting || phase > 23);
  const radius = working ? 4.65 : visiting ? 2.3 : 4.65;
  const angle =
    stationAngle(index) +
    (!meeting && !working && phase > 18 && phase < 23
      ? Math.sin(((phase - 18) / 5) * Math.PI) * 0.13
      : 0);
  return {
    x: Math.sin(angle) * radius,
    z: Math.cos(angle) * radius,
    angle: working ? angle : angle + Math.PI,
    visiting,
  };
}
