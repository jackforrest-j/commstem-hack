// In-memory state for the active journey and child location
let activeJourney = null;
let childLocation = null;

module.exports = {
  getJourney:        ()    => activeJourney,
  setJourney:        (j)   => { activeJourney = j; },
  getChildLocation:  ()    => childLocation,
  setChildLocation:  (loc) => { childLocation = loc; },
};
