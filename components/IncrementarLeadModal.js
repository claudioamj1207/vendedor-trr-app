"use client";
import React, { useEffect, useMemo, useState } from 'react';

function montarEstadoInicial(lead) {
  return {
    inscricao_estadual: lead?.inscricao_estadual || '',
    inscricao_municipal: lead?.inscricao_municipal || '',
    contato_nome: lead?.contato_nome || '',
    telefone_1: lead?.telefone_1 || '',
    email: lead?.email || '',
    endereco_obra: lead?.endereco_obra || '',
    observacoes: lead?.observacoes || ''
  };
}

function Campo({ label, name, value, onChange, placeholder = '' }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">
        {label}
      </p>
      <input
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-3 text-[12px] text-white outline-none"
      />
    </div>
  );
}

export default function IncrementarLeadModal({
  lead,
  isOpen,
  onClose,
  onSave,
  salvando = false
}) {
  const [form, setForm] = useState(montarEstadoInicial(lead));

  const titulo = useMemo(() => lead?.razao_social || 'Lead', [lead]);

  useEffect(() => {
    setForm(montarEstadoInicial(lead));
  }, [lead]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !lead) return null;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSave?.(form);
  };

  return (
    <div className="fixed inset-0 z-[9999]">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-3xl max-h-[94vh] overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-white/5 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">
                  Incrementar Lead
                </p>
                <h2 className="text-lg md:text-2xl font-black uppercase text-white leading-tight break-words">
                  {titulo}
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="shrink-0 h-11 px-4 rounded-xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wide hover:bg-red-500 active:scale-95 transition-all"
              >
                Fechar
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(94vh-90px)] px-5 py-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Campo
                label="Insc. Estadual"
                name="inscricao_estadual"
                value={form.inscricao_estadual}
                onChange={handleChange}
              />

              <Campo
                label="Insc. Municipal"
                name="inscricao_municipal"
                value={form.inscricao_municipal}
                onChange={handleChange}
              />

              <Campo
                label="Contato"
                name="contato_nome"
                value={form.contato_nome}
                onChange={handleChange}
              />

              <Campo
                label="Telefone"
                name="telefone_1"
                value={form.telefone_1}
                onChange={handleChange}
              />

              <div className="md:col-span-2">
                <Campo
                  label="Email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>

              <div className="md:col-span-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">
                  Endereço de obra
                </p>
                <textarea
                  name="endereco_obra"
                  value={form.endereco_obra}
                  onChange={handleChange}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-3 text-[12px] text-white outline-none min-h-[96px]"
                />
              </div>

              <div className="md:col-span-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">
                  Observações
                </p>
                <textarea
                  name="observacoes"
                  value={form.observacoes}
                  onChange={handleChange}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-3 text-[12px] text-white outline-none min-h-[140px]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={salvando}
                className="h-11 px-5 rounded-xl bg-zinc-800 border border-white/10 text-white text-[11px] font-black uppercase tracking-wide hover:bg-zinc-700 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={salvando}
                className="h-11 px-5 rounded-xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wide hover:bg-blue-500 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
