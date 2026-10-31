import localCatalog from "./catalog.json";
import { catalogSchema, type Profile } from "./schema";
const antares: Profile = {
  id: "antares", name: "Antares", role: "Comercial e prospecção",
  summary: "Pesquisa oportunidades comerciais, organiza evidências e prepara abordagens em rascunho para revisão humana.",
  principles: [], sources: [],
  actions: [
    { title: "Pesquisar oportunidades", description: "Solicite uma pesquisa com fontes e critérios claros.", dependency: "Conexão do agente", availability: "pending", checkedAt: null, approval: "read", enforcement: "none", example: "Antares, pesquise uma oportunidade real e mostre as evidências." },
    { title: "Preparar um rascunho", description: "Prepara uma abordagem para você revisar. Não envia mensagens ao cliente.", dependency: "Contexto e revisão humana", availability: "pending", checkedAt: null, approval: "explicit", enforcement: "instructions", example: "Antares, prepare uma abordagem em rascunho para minha revisão." }
  ]
};
// Static presentation only. Operational sources arrive through the authenticated publisher.
export const reference = catalogSchema.parse({
  ...localCatalog,
  profiles: [...localCatalog.profiles.filter((profile) => profile.id !== "antares"), antares]
});
