// Per-parent store keyed by parentId (Supabase user UUID)
const stores = new Map();

function get(parentId) {
  if (!parentId) return { journey: null, childLocation: null, manualState: null };
  if (!stores.has(parentId)) {
    stores.set(parentId, { journey: null, childLocation: null, manualState: null });
  }
  return stores.get(parentId);
}

module.exports = {
  getJourney:       (pid) => get(pid).journey,
  setJourney:       (pid, j) => { const s = get(pid); s.journey = j; s.manualState = null; },
  getChildLocation: (pid) => get(pid).childLocation,
  setChildLocation: (pid, loc) => { get(pid).childLocation = loc; },
  getManualState:   (pid) => get(pid).manualState,
  setManualState:   (pid, s) => { get(pid).manualState = s; },
  reset:            (pid) => stores.delete(pid),
};
