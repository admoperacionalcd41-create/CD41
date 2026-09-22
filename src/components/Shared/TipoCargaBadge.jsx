import React from 'react';
import { getTipoCarga } from '../../utils/tipoCarga';

// Etiqueta compacta "Seca"/"Resfriada", reutilizada em todas as telas onde
// uma loja aparece (board de agrupamento, boxes, etiquetas, protocolo,
// relatórios...). Puramente informativa — ver utils/tipoCarga.js.
export default function TipoCargaBadge({ tipo, className = '' }) {
  const cfg = getTipoCarga(tipo);
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cfg.corBadge} ${className}`}
    >
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${cfg.corPonto}`} />
      {cfg.texto}
    </span>
  );
}
