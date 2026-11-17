import React from 'react';
import styles from './ToolGroupTitle.module.css';

export interface ToolGroupTitleProps {
  label: string;
}

/**
 * Nome pequeno de cada conjunto de ferramentas do dock, renderizado DENTRO do
 * card do grupo (acima dos botões). Sem card próprio: a legenda acompanha o
 * bloco ao qual pertence, então quando o grupo não aparece a legenda some junto.
 */
export const ToolGroupTitle: React.FC<ToolGroupTitleProps> = ({ label }) => (
  <span className={styles.title}>{label}</span>
);

/**
 * Subtítulo discreto para separar subgrupos dentro de um mesmo card do dock
 * (ex.: "Alinhamento", "Camadas", "Cópia e exclusão").
 */
export const ToolSubgroupTitle: React.FC<ToolGroupTitleProps> = ({ label }) => (
  <span className={styles.subtitle}>{label}</span>
);
