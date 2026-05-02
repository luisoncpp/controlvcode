import { PromptBuilder } from "./PromptBuilder";
import { PromptBuilderUI } from "./PromptBuilderUI";

export function PromptBuilderComponent({ feedbackXml }: { feedbackXml: string }) {
  // Crear instancia cada vez que cambia el feedback (o memoizar)
  const builder = new PromptBuilder(feedbackXml);
  return <PromptBuilderUI builder={builder} />;
}
