let activeJourney = null;
let childLocation = null;
let manualState   = null;

module.exports = {
  getJourney:       ()    => activeJourney,
  setJourney:       (j)   => { activeJourney = j; manualState = null; },
  getChildLocation: ()    => childLocation,
  setChildLocation: (loc) => { childLocation = loc; },
  getManualState:   ()    => manualState,
  setManualState:   (s)   => { manualState = s; },
  reset:            ()    => { activeJourney = null; childLocation = null; manualState = null; },
};
