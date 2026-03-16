'use client'

import { useEffect, useState, useRef } from 'react'

type Cond = {
  id: number
  name: string
  percent: string
}

export default function CondicoesPagamentoPage() {
  const [rows, setRows] = useState<Array<{ id?: number | null; name: string; percent: string | number }>>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const deletedIdsRef = useRef<Set<number>>(new Set())
  const originalRef = useRef<Record<number, { name: string; percent: number }>>({})
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout> | null>>({})

  async function load() {
    const res = await fetch('/api/condicoes-pagamento')
    const json = await res.json()
    if (json?.ok) setRows(json.data || [])
  }

  useEffect(() => {
    load()
  }, [])
  // populate originalRef after load
  useEffect(() => {
    originalRef.current = {}
    rows.forEach((r) => {
      if (r.id) originalRef.current[Number(r.id)] = { name: r.name, percent: Number(r.percent || 0) }
    })
  }, [rows])

  function handleAdd() {
    setRows((prev) => [...prev, { id: null, name: '', percent: '' }])
  }

  async function handleRemove(index: number) {
    const row = rows[index]
    // cancel pending timer for this index
    if (debounceTimers.current[index]) {
      clearTimeout(debounceTimers.current[index] as any)
      debounceTimers.current[index] = null
    }
    setRows((prev) => prev.filter((_, i) => i !== index))
    if (row?.id) {
      // immediate delete
      try {
        const res = await fetch('/api/condicoes-pagamento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ create: [], update: [], delete: [Number(row.id)] }),
        })
        const json = await res.json()
        if (json?.ok) {
          // reload authoritative list
          setRows(json.data || [])
        } else {
          alert('Falha ao remover: ' + (json?.error || 'erro'))
        }
      } catch (e) {
        alert('Erro ao remover')
      }
    }
  }

  function handleChange(index: number, field: 'name' | 'percent', value: string) {
    setRows((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }

      // schedule auto-save for this row using the up-to-date `next` value
      if (debounceTimers.current[index]) {
        clearTimeout(debounceTimers.current[index] as any)
      }
      debounceTimers.current[index] = setTimeout(async () => {
        const current = next[index]
        if (!current) {
          debounceTimers.current[index] = null
          return
        }
        try {
          if (current.id) {
            // update
            const res = await fetch('/api/condicoes-pagamento', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ create: [], update: [{ id: Number(current.id), name: String(current.name).trim(), percent: Number(current.percent || 0) }], delete: [] }),
            })
            const json = await res.json()
            if (json?.ok) setRows(json.data || [])
          } else {
            // create if name provided
            if (!String(current.name || '').trim()) {
              debounceTimers.current[index] = null
              return
            }
            const res = await fetch('/api/condicoes-pagamento', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ create: [{ name: String(current.name).trim(), percent: Number(current.percent || 0) }], update: [], delete: [] }),
            })
            const json = await res.json()
            if (json?.ok) setRows(json.data || [])
          }
        } catch (e) {
          // ignore
        } finally {
          debounceTimers.current[index] = null
        }
      }, 800)

      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const toCreate = rows.filter((r) => !r.id && String(r.name || '').trim() !== '').map((r) => ({ name: String(r.name).trim(), percent: Number(r.percent || 0) }))
      const toUpdate = rows
        .filter((r) => r.id)
        .map((r) => ({ id: Number(r.id), name: String(r.name).trim(), percent: Number(r.percent || 0) }))
        .filter((r) => {
          const orig = originalRef.current[r.id]
          return !orig || orig.name !== r.name || Number(orig.percent) !== Number(r.percent)
        })
      const toDelete = Array.from(deletedIdsRef.current)

      const payload = { create: toCreate, update: toUpdate, delete: toDelete }
      const res = await fetch('/api/condicoes-pagamento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (json?.ok) {
        deletedIdsRef.current.clear()
        await load()
      } else {
        alert('Falha ao salvar: ' + (json?.error || 'erro'))
      }
    } catch (e) {
      alert('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="py-4">
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h4 className="mb-0">Condições de pagamento</h4>
              <small className="text-muted">Gerencie condições e adicional administrativo (%)</small>
            </div>
          </div>

          <div className="mb-3">
            <div className="row g-2">
              <div className="col-12">
                <div className="list-group">
                  {rows.map((r, idx) => (
                    <div key={(r.id ?? 'new') + '_' + idx} className="list-group-item d-flex align-items-center gap-2">
                      <div className="flex-grow-1 row g-2 align-items-center">
                        <div className="col-md-6">
                          <input className="form-control" value={r.name} onChange={(e) => handleChange(idx, 'name', e.target.value)} placeholder="Condição (ex: 14/21D)" />
                        </div>
                        <div className="col-md-5">
                          <input className="form-control" value={String(r.percent ?? '')} onChange={(e) => handleChange(idx, 'percent', e.target.value)} placeholder="Adicional administrativo (%)" />
                        </div>
                        <div className="col-md-1 d-flex justify-content-end">
                          <button type="button" className="btn btn-sm btn-danger" title="Remover" onClick={() => handleRemove(idx)}>✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {rows.length === 0 && <div className="list-group-item text-muted">Nenhuma condição cadastrada</div>}
                </div>
              </div>
            </div>

            <div className="mt-3 d-flex gap-2">
              <button type="button" className="btn btn-primary" onClick={handleAdd}>Adicionar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

