#pragma once

#include <WebServer.h>

extern WebServer server;

void initHttpServer();
void handleHttpClient();
void sendJson(int statusCode, const String& body);
void sendNotFound();
