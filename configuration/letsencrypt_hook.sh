#!/bin/bash
# /etc/letsencrypt/renewal-hooks/deploy/peer-server-cert-copy.sh
mkdir -p /etc/peer-server/certs/
cp -p /etc/letsencrypt/live/communication.perpetuumit.com/fullchain.pem /etc/peer-server/certs/
cp -p /etc/letsencrypt/live/communication.perpetuumit.com/privkey.pem /etc/peer-server/certs/
chown peerserveruser:peerserveruser /etc/peer-server/certs/*
chmod 600 /etc/peer-server/certs/*
systemctl restart peer-server

mkdir -p /etc/turn-server/certs/
cp -p /etc/letsencrypt/live/communication.perpetuumit.com/fullchain.pem /etc/turn-server/certs/
cp -p /etc/letsencrypt/live/communication.perpetuumit.com/privkey.pem /etc/turn-server/certs/
chown coturn:coturn /etc/turn-server/certs/*
chmod 600 /etc/turn-server/certs/*
systemctl restart coturn
