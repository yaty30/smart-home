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

// Connection/transport state (separate from pairing credential state)
enum class LgConnectionState {
  Idle,           // No active session
  Connecting,     // WebSocket connecting
  Registering,    // Sending register/auth message
  Ready,          // Authenticated and ready for commands
  Reconnecting,   // Attempting reconnect with stored key
  Sleeping,       // TV powered off
  Waking,         // Sent WOL, waiting for TV to boot
  Failed          // Connection failed
};

class LgWebOsTv {
public:
  LgWebOsTv();
  ~LgWebOsTv();

  // Start first-time pairing with a discovered TV
  void startPairing(const char* ip, const char* mac = nullptr);

  // Check pairing state (first-time pairing only)
  LgPairingState getPairingState() const { return pairingState; }
  const char* getClientKey() const { return clientKey; }

  // Check connection/transport state
  LgConnectionState getConnectionState() const { return connectionState; }
  bool hasPairedCredential() const { return clientKey[0] != '\0'; }
  bool isReady() const { return connectionState == LgConnectionState::Ready; }
  bool isConnected() const { return wsConnected; }
  bool isPointerReady() const { return pointerConnected; }

  // Get stored MAC address (may be obtained during connection)
  const char* getMacAddress() const { return tvMac; }

  // Connect using stored credentials (for session start)
  void startSession(const char* ip, const char* storedClientKey, const char* mac = nullptr);

  // Stop session (disconnect but preserve credential)
  void stopSession();

  // Submit PIN during first-time pairing
  bool submitPin(const char* pin);

  // Initiate power-off sequence
  bool sendPowerOff();

  // Initiate wake sequence (call after WOL sent)
  void startWakeSequence();

  // Send commands (TV must be ready)
  bool sendVolumeUp();
  bool sendVolumeDown();
  bool sendMute();
  bool sendChannelUp();
  bool sendChannelDown();
  bool sendPlay();
  bool sendPause();
  bool sendStop();
  bool sendRewind();
  bool sendFastForward();

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

  // Disconnect (preserves pairing credential)
  void disconnect();

private:
  WebSocketsClient* ws;
  WebSocketsClient* pointerWs;  // Separate WebSocket for pointer input

  // Pairing state (for first-time pairing only)
  LgPairingState pairingState;

  // Connection/transport state
  LgConnectionState connectionState;

  // Stored credentials and device info
  char clientKey[512];
  char tvIp[16];
  char tvMac[18];
  char pointerSocketPath[128];

  // Connection state tracking
  bool wsConnected;
  bool pointerConnected;
  bool registrationSent;
  unsigned long pairingTimeout;
  unsigned long lastSuccessfulResponse;

  // Reconnect management
  unsigned long reconnectAttemptTime;
  uint8_t reconnectAttempts;
  uint32_t requestId;

  // Power state tracking
  bool powerOffSent;
  unsigned long powerOffTime;

  // Reconnect backoff
  static constexpr unsigned long RECONNECT_INITIAL_DELAY_MS = 2000;
  static constexpr unsigned long RECONNECT_MAX_DELAY_MS = 30000;

  void onWebSocketEvent(int type, uint8_t* payload, size_t length);
  void onPointerEvent(int type, uint8_t* payload, size_t length);
  void processMessage(const char* payload);
  void processPointerMessage(const char* payload);
  void sendRegisterRequest(bool forcePairing, bool usePin);
  void connectPointerSocket();
  void requestNetworkInfo();
  bool sendCommand(const char* uri);
  bool sendPointerCommand(const char* type);

  // Reconnect helpers
  void handleReconnect();
  void scheduleReconnect();
  unsigned long getReconnectDelay() const;
  void resetReconnectState();
  void initiateConnection();
  void markConnectionFailed();
  void markSleeping();

  static LgWebOsTv* instance;  // For WebSocket callback
};
