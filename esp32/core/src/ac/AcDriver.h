#pragma once

#include "AcTypes.h"
#include "../../State.h"

// Abstract interface every brand driver must implement.
// The rest of the firmware interacts only with this type.
class AcDriver {
public:
  virtual ~AcDriver() = default;

  // Called once after construction — initialises the underlying IR object.
  virtual void begin() = 0;

  // Translate state to brand-specific IR bytes and transmit.
  // Returns true on success.
  virtual bool send(const AcState& state) = 0;

  // Feature capability query.  Used by the API layer to report which controls
  // are available for this device so the app can hide unsupported UI elements.
  virtual bool supportsFeature(AcFeature feature) const = 0;

  // Human-readable name of the active protocol, e.g. "panasonic_ac_dke".
  virtual const char* protocolName() const = 0;
};
