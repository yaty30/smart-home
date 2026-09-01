#pragma once

#include "AcDriver.h"
#include "AcTypes.h"
#include "../State.h"

// Central factory and controller.  The rest of the firmware calls only this —
// never a brand-specific IR class directly.
class AcController {
public:
  AcController();
  ~AcController();

  // Select brand + protocol + model and instantiate the matching driver.
  // Safe to call more than once; the previous driver is destroyed first.
  void configure(const AcDeviceConfig& config);

  // Transmit the given state through the active driver.
  // Returns false if no driver is configured or the send fails.
  bool send(const AcState& state);

  bool supportsFeature(AcFeature feature) const;

  bool isConfigured() const;
  const AcDeviceConfig& getConfig() const;

  // Human-readable protocol name, e.g. "panasonic_ac_dke".
  const char* protocolName() const;

  // Initialise the underlying driver (called automatically by configure()).
  void begin();

private:
  AcDriver*    activeDriver_;
  AcDeviceConfig config_;

  AcDriver* createDriver(const AcDeviceConfig& config) const;
};

// Singleton accessor — one AC controller for the whole firmware.
AcController& acController();
