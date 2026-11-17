import React from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  CaseUpper,
  Heading,
  Sparkles,
  Trash2,
  Type,
} from 'lucide-react';
import { FONT_SIZE_MIN, HEADING_FONT_SIZE_MAX, TEXT_BORDER_COLORS } from '../brand/brand';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ColorSwatches } from '../components/ui/ColorSwatches';
import { HelpTip } from '../components/ui/HelpTip';
import { ElementListRow } from '../components/ui/ElementListRow';
import { IconButton } from '../components/ui/IconButton';
import { Segmented } from '../components/ui/Segmented';
import { Slider } from '../components/ui/Slider';
import { textSizeLimits } from '../lib/textRules';
import { useEditor, useSelected } from '../store/editorStore';
import type { BorderKind, TextEl } from '../types';
import styles from './StepPanel.module.css';

export const TextStep: React.FC = () => {
  const addText = useEditor((s) => s.addText);
  const updateElement = useEditor((s) => s.updateElement);
  const removeElement = useEditor((s) => s.removeElement);
  const select = useEditor((s) => s.select);
  const elements = useEditor((s) => s.doc.elements);

  const selected = useSelected();
  const selectedText = selected && selected.kind === 'text' ? (selected as TextEl) : null;

  const currentTexts = elements.filter((e): e is TextEl => e.kind === 'text');

  // Calcula os limites de tamanho do texto selecionado para o slider
  const limits = selectedText
    ? textSizeLimits(elements, selectedText)
    : { min: FONT_SIZE_MIN, max: HEADING_FONT_SIZE_MAX, reason: 'absolute' as const };

  return (
    <div className={styles.container}>
      <div className={styles.titleRow}>
        <h2 className={styles.title}>4. Escreve aí 📝</h2>
        <HelpTip
          label="Sobre esta etapa"
          align="end"
          tip="Adicione títulos, textos ou caixas de destaque com as fontes e cores da identidade visual."
        />
      </div>

      {/* Botões de Adicionar Novos Textos */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Adicionar à folha</h3>
        <div className={styles.buttonGrid}>
          <Button
            variant="secondary"
            size="sm"
            className={styles.addTextButton}
            icon={<Heading size={18} strokeWidth={2.5} />}
            onClick={() => addText('title')}
          >
            + Título
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className={styles.addTextButton}
            icon={<Type size={18} strokeWidth={2.5} />}
            onClick={() => addText('body')}
          >
            + Texto
          </Button>
        </div>
      </div>

      {/* Edição do Texto Selecionado */}
      {selectedText && (
        <Card
          title="Editar Texto"
          action={
            <IconButton
              icon={<Trash2 size={16} strokeWidth={2.5} />}
              label="Excluir texto"
              variant="danger"
              size="sm"
              onClick={() => removeElement(selectedText.id)}
            />
          }
        >
          {/* Conteúdo do Texto */}
          <div className={styles.editStack}>
            <div className={styles.section}>
              <textarea
                value={selectedText.text}
                onChange={(e) => updateElement(selectedText.id, { text: e.target.value })}
                placeholder="Digite o texto aqui..."
                rows={3}
                className={styles.textarea}
              />
            </div>

            {/* CAIXA ALTA e TEXTO COM BORDA: lado a lado logo abaixo do texto */}
            <div className={styles.togglePair}>
              <Button
                variant="secondary"
                size="sm"
                className={styles.toggleBtn}
                icon={<CaseUpper size={16} strokeWidth={2.5} />}
                aria-pressed={selectedText.uppercase}
                onClick={() => updateElement(selectedText.id, { uppercase: !selectedText.uppercase })}
              >
                <span className={styles.toggleLabel}>
                  <span>Tudo maiúsculo</span>
                  <span
                    className={`${styles.caseBadge} ${selectedText.uppercase ? styles.caseBadgeActive : ''}`}
                    aria-hidden="true"
                  >
                    {selectedText.uppercase ? 'AA' : 'aa'}
                  </span>
                </span>
              </Button>

              <Button
                variant="primary"
                size="sm"
                className={styles.toggleBtn}
                icon={<Sparkles size={16} strokeWidth={2.5} />}
                aria-pressed={selectedText.brandEffect}
                onClick={() =>
                  updateElement(selectedText.id, { brandEffect: !selectedText.brandEffect })
                }
              >
                <span className={styles.toggleLabel}>
                  <span>Texto com borda</span>
                  <span
                    className={`${styles.effectDot} ${selectedText.brandEffect ? styles.effectDotActive : ''}`}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                </span>
              </Button>
            </div>

            {selectedText.brandEffect && (
              <ColorSwatches
                label="Cor da borda:"
                colors={TEXT_BORDER_COLORS}
                columns={5}
                ariaLabelPrefix="Cor da borda"
                value={selectedText.brandEffectColor ?? 'creme'}
                onChange={(brandEffectColor) =>
                  updateElement(selectedText.id, { brandEffectColor })
                }
              />
            )}

            {/* Slider de Tamanho com marcador de limite e regra Texto <= Título */}
            <Slider
              label="Tamanho da Fonte"
              value={selectedText.fontSize}
              min={limits.min}
              max={limits.max}
              step={1}
              limitMarker={
                selectedText.style === 'body'
                  ? { value: limits.max, label: 'Limite permitido pelo menor título' }
                  : undefined
              }
              onChange={(val) => {
                updateElement(selectedText.id, { fontSize: val });
              }}
            />

            {/* Alinhamento Horizontal do Parágrafo */}
            <div className={styles.section}>
              <span className={styles.fieldLabel}>Alinhamento do Texto</span>
              <Segmented
                options={[
                  { value: 'left', label: <AlignLeft size={16} strokeWidth={2.5} />, hint: 'À esquerda' },
                  { value: 'center', label: <AlignCenter size={16} strokeWidth={2.5} />, hint: 'Centralizado' },
                  { value: 'right', label: <AlignRight size={16} strokeWidth={2.5} />, hint: 'À direita' },
                ]}
                value={selectedText.align}
                onChange={(align) => updateElement(selectedText.id, { align })}
              />
            </div>

            {/* Cor do texto (2 colunas) + Caixa de destaque (empilhada) */}
            <div className={styles.dualColumn}>
              <ColorSwatches
                value={selectedText.color}
                onChange={(color) => updateElement(selectedText.id, { color })}
              />

              <div className={styles.borderSection}>
                <span className={styles.fieldLabel}>Caixa de destaque</span>
                <Segmented<BorderKind>
                  direction="column"
                  className={styles.borderSegmented}
                  options={[
                    { value: 'none', label: 'Nenhuma' },
                    { value: 'yellow', label: 'Amarela' },
                    { value: 'clay', label: 'Barro' },
                  ]}
                  value={selectedText.border}
                  onChange={(border) => updateElement(selectedText.id, { border })}
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Lista de textos na folha */}
      {currentTexts.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Textos na folha ({currentTexts.length})</h3>
          <div className={styles.elementList}>
            {currentTexts.map((t) => {
              const label = t.text ? `"${t.text.slice(0, 18)}..."` : 'Texto vazio';
              return (
                <ElementListRow
                  key={t.id}
                  label={label}
                  selectLabel={`Selecionar texto ${label}`}
                  removeLabel="Remover"
                  selected={selectedText?.id === t.id}
                  onSelect={() => select(t.id)}
                  onRemove={() => removeElement(t.id)}
                  bullet
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
