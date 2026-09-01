#pragma once

#include <WebServer.h>

class TvManager;

extern WebServer server;

void initHttpServer();
void handleHttpClient();
void sendJson(int statusCode, const String& body);
void sendNotFound();
void setTvManager(TvManager* manager);
