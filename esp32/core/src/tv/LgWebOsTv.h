#pragma once

#include "TvTypes.h"
#include <functional>

// Forward declaration
class WebSocketsClient;

enum class LgPairingState {
  Idle,
  Connecting,
  WaitingForPin,
  WaitingForApproval,
  Paired,
  Failed
};

class LgWebOsTv {
public:
  LgWebOsTv();
  ~LgWebOsTv();

  // Start pairing with a discovered TV
  void startPairing(const char* ip);

  // Check pairing state
  LgPairingState getPairingState() const { return pairingState; }
  const char* getClientKey() const { return clientKey; }
  bool isPaired() const { return pairingState == LgPairingState::Paired && clientKey[0] != '\0'; }

  // Connect to previously paired TV
  bool connect(const char* ip, const char* storedClientKey);
  bool submitPin(const char* pin);

  // Send commands (TV must be connected)
  bool sendPowerOff();
  bool sendVolumeUp();
  bool sendVolumeDown();
  bool sendMute();
  bool sendChannelUp();
  bool sendChannelDown();
  bool sendPlay();
  bool sendPause();
  bool sendStop();

  // Navigation via pointer input socket
  bool sendUp();
  bool sendDown();
  bool sendLeft();
  bool sendRight();
  bool sendOk();
  bool sendBack();
  bool sendHome();
  bool sendMenu();
  bool sendInput();

  // Must be called regularly from main loop
  void handle();

  // Disconnect
  void disconnect();

private:
  WebSocketsClient* ws;
  WebSocketsClient* pointerWs;  // Separate WebSocket for pointer input
  LgPairingState pairingState;
  char clientKey[512];
  char tvIp[16];
  char pointerSocketPath[128];
  unsigned long pairingTimeout;
  bool connected;
  bool pointerConnected;
  uint32_t requestId;

  void onWebSocketEvent(int type, uint8_t* payload, size_t length);
  void onPointerEvent(int type, uint8_t* payload, size_t length);
  void processMessage(const char* payload);
  void processPointerMessage(const char* payload);
  void sendRegisterRequest(bool forcePairing, bool usePin);
  void connectPointerSocket();
  bool sendCommand(const char* uri);
  bool sendPointerCommand(const char* type);

  static LgWebOsTv* instance;  // For WebSocket callback
};
