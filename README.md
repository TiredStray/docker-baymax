# docker-baymax
a Node daemon that communicates directly with the Docker engine API over a local Unix socket to implement asynchronous, event-driven self-healing infrastructure

## The Problem: 

 The need of a lightweight, zero-dependency, platform-agnostic daemon to handle container self-healing on edge hardware (Raspberry Pi) without the heavy footprint of enterprise orchestrators.

## The Architecture: 

Queries the native Docker Engine via the UNIX socket (/var/run/docker.sock) asynchronously using a state-comparison algorithm.

## Resiliency Features: 

 Implements an Exponential Backoff and Quarantine Algorithm to mitigate infinite loop cascading failures.
 
