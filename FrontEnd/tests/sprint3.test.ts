import assert from "node:assert/strict";
import test from "node:test";
import { createSprint3Session, readMagazine } from "../src/sprint3/session.ts";
import type { ResetEntry } from "../src/sprint3/session.ts";
import { readBenchObservation } from "../src/sprint3/bench.ts";
import { readRegisteredBlocks, reconcileSlot } from "../src/sprint3/magazine.ts";

const start = Date.parse("2026-11-18T20:00:00.000Z");
const stamp = (offset: number) => new Date(start + offset * 1000).toISOString();
const scope = { schemaVersion: "1.0", unitId: "N2", assetId: "EXPEDICAO" };
const base = { ...scope, origin: "medido", quality: "GOOD", streamId: "teste" };
const piece = (seq: number, inspection: string) => ({ ...base, type: "piece.processed", seq, timestamp: stamp(seq),
  pieceId: `p-${seq}`, eventId: `evento-${seq}`, productionOrderId: null, inspection });
const analysis = { ...base, type: "analysis.window", seq: 9, eventId: "janela", timestamp: stamp(90), startedAt: stamp(0),
  plannedSeconds: 90, operatingSeconds: 72, idealCycleSeconds: 12 };
const criteria = { nominalPerHour: 300, inspection: "Inspeção aprovada na fixture", reference: "Teste" };
const occupancy = Array.from({ length: 12 }, (_, i) => i === 3 ? true : null);

function frame(events: unknown[], fields: Record<string, unknown> = {}) {
  return { origin: "medido", timestamp: stamp(90), estacoes: { expedicao: { ...scope,
    inicioSessao: stamp(0), modoProducao: "pieces", eventos: events, criterios: criteria,
    ocupacao: occupancy, posicaoAtuador: 4, ...fields } } };
}

test("OEE Sprint 3 limita performance a 100% e calcula os três fatores e PPM", () => {
  const session = createSprint3Session("medido", () => start + 90_000);
  const pieces = Array.from({ length: 8 }, (_, i) => piece(i + 1, i === 2 ? "REJECTED" : "APPROVED"));
  session.receive(frame([...pieces, analysis]));
  const view = session.view();
  assert.equal(view.snapshot?.totalProduced, 8);
  assert.equal(view.snapshot?.approved, 7);
  assert.deepEqual(view.indicators, { availability: 80, performance: 100, quality: 87.5, oee: 70,
    ppm: 8 * 60 / 72, downtimeSeconds: 18 });
  assert.equal(view.magazine?.actuatorPosition, 4);
});

test("snapshots de posição e entradas sem proveniência não contabilizam peças", () => {
  const session = createSprint3Session("medido", () => start + 90_000);
  session.receive({ timestamp: stamp(10), estacao: 4, posicao: 5, qualidade: true });
  session.receive(frame([], { ocupacao: [true], posicaoAtuador: 13 }));
  assert.equal(session.view().snapshot, null);
  assert.equal(session.view().magazine, null);
  assert.equal(session.view().indicators.oee, null);
  session.receive(frame([]));
  assert.equal(session.view().magazine?.positions[3], true);
  assert.equal(session.view().magazine?.positions[2], null);
  assert.equal(session.view().productionKnown, false);
  assert.equal(readMagazine(Array(12).fill(0), stamp(10)), null);
  assert.equal(readMagazine(Array(12), stamp(10)), null);
});

test("qualidade incerta, origem simulada, escopo estrangeiro e duplicatas não viram peças", () => {
  const session = createSprint3Session("medido", () => start + 90_000);
  session.receive(frame([piece(1, "APPROVED"), { ...piece(2, "APPROVED"), quality: "UNCERTAIN" },
    { ...piece(3, "APPROVED"), origin: "simulado" }, { ...piece(4, "APPROVED"), assetId: "OUTRO" }]));
  session.receive(frame([piece(1, "APPROVED")]));
  session.receive(frame([], { assetId: "OUTRO", ocupacao: Array(12).fill(false) }));
  assert.equal(session.view().snapshot?.totalProduced, 1);
  assert.equal(session.view().magazine?.positions[3], true);
  assert.equal(session.view().indicators.oee, null);
});

test("reset registra autor e horário antes de zerar, conserva magazine e deduplicação", () => {
  const session = createSprint3Session("medido", () => start + 91_000);
  session.receive(frame([piece(1, "APPROVED"), analysis]));
  assert.throws(() => session.reset("Ana", () => { throw new Error("armazenamento indisponível"); }));
  assert.equal(session.view().snapshot?.totalProduced, 1);
  const entries: ResetEntry[] = [];
  session.reset(" Ana ", entry => {
    assert.equal(session.view().snapshot?.totalProduced, 1);
    entries.push(entry);
  });
  assert.deepEqual(entries, [{ author: "Ana", at: stamp(91), unitId: "N2", assetId: "EXPEDICAO", totalBefore: 1 }]);
  assert.equal(session.view().snapshot?.totalProduced, 0);
  assert.equal(session.view().magazine?.positions[3], true);
  session.receive({ ...piece(1, "APPROVED"), seq: 15, timestamp: stamp(92), eventId: "replay" });
  assert.equal(session.view().snapshot?.totalProduced, 0);
});

test("gestor indisponível ou sem autorização preserva N/D e posição zero não é vaga", () => {
  const data = readBenchObservation({ observedAt: stamp(10), stored: 2, removed: 0, busy: false,
    magazine: { status: "unauthorized", firstFree: 8 } });
  assert.equal(data.stored, 2);
  assert.equal(data.removed, null);
  assert.equal(data.busy, false);
  assert.equal(data.magazine.firstFree, null);
});

test("inventário parcial confirma registros presentes; lista completa permite comparar divergências", () => {
  const rows = [{ storageId: 1, position: 7 }, { StorageId: 2, position: 4 }];
  const partial = readRegisteredBlocks(rows, stamp(10));
  assert.equal(partial?.positions[3], true);
  assert.equal(partial?.positions[6], null);
  assert.equal(reconcileSlot(false, partial?.positions[6] ?? null), "unknown");
  const complete = readRegisteredBlocks({ complete: true, items: rows }, stamp(10));
  assert.equal(reconcileSlot(true, complete?.positions[3] ?? null), "matches");
  assert.equal(reconcileSlot(true, complete?.positions[6] ?? null), "differs");
  assert.equal(readRegisteredBlocks({ complete: true, items: [...rows, { position: 5 }] }, stamp(10)), null);
  assert.equal(readRegisteredBlocks({ complete: true, items: [...rows, rows[1]] }, stamp(10)), null);
  assert.equal(readBenchObservation({ observedAt: stamp(10), magazine: { status: "available", registered: complete } }).magazine.registered?.positions[6], false);
  const session = createSprint3Session("medido", () => start + 90_000);
  session.receive(frame([], { estoqueRegistrado: complete, ocupacao: Array(12).fill(null) }));
  assert.equal(session.view().magazine?.positions[3], null);
  assert.equal(session.view().registered?.positions[3], true);
});

function counterFrame(seq: number, offset: number, good: number, bad: number, planned: number | null, operating: number | null, epoch = "turno-A") {
  return { ...frame([], { amostraAcumulada: { epoch, seq, timestamp: stamp(offset), quality: "GOOD",
    totalProduced: good + bad, approved: good, rejected: bad, plannedSeconds: planned, operatingSeconds: operating } }), timestamp: stamp(offset) };
}

test("contadores acumulados só calculam deltas de peças e tempos desde a mesma referência", () => {
  const session = createSprint3Session("medido", () => start + 200_000);
  session.receive(counterFrame(2, 20, 100, 10, 180, 120));
  assert.equal(session.view().counts, null);
  assert.equal(session.view().indicators.oee, null);
  session.receive(counterFrame(3, 110, 107, 11, 270, 192));
  assert.equal(session.view().counts?.totalProduced, 8);
  assert.equal(session.view().indicators.oee, 70);
  assert.equal(session.view().indicators.downtimeSeconds, 18);
  session.receive(counterFrame(3, 110, 108, 12, 270, 192));
  session.receive(frame([piece(1, "APPROVED")]));
  assert.equal(session.view().counts?.totalProduced, 8);
  session.receive(counterFrame(4, 120, 108, 11, null, null));
  assert.equal(session.view().counts?.totalProduced, 9);
  assert.equal(session.view().indicators.oee, null);
});

test("mudança de época mantém OEE indisponível até reset auditado e próxima amostra", () => {
  const session = createSprint3Session("medido", () => start + 200_000);
  session.receive(counterFrame(1, 20, 7, 1, 90, 72));
  session.receive(counterFrame(2, 90, 13, 1, 160, 132));
  session.receive(counterFrame(1, 95, 0, 0, 5, 4, "turno-B"));
  assert.equal(session.view().cumulative?.state, "epoch-change");
  assert.equal(session.view().indicators.oee, null);
  assert.throws(() => session.reset("Ana", () => { throw new Error("auditoria offline"); }));
  assert.equal(session.view().cumulative?.state, "epoch-change");
  const sent: ResetEntry[] = [];
  session.reset("Ana", entry => sent.push(entry));
  assert.equal(sent[0].referenceAt, stamp(95));
  assert.equal(sent[0].totalBefore, 6);
  assert.equal(session.view().counts, null);
  session.receive(counterFrame(2, 105, 1, 0, 15, 12, "turno-B"));
  session.receive(counterFrame(3, 106, 20, 1, 171, 140, "turno-A"));
  assert.equal(session.view().counts?.totalProduced, 1);
  assert.equal(session.view().indicators.oee, 80);
});
