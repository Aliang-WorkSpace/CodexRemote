import os from "node:os";

export function buildAccessUrls({
  port,
  listenHost = "127.0.0.1",
  publicBaseUrl = null,
  localBaseUrl = `http://127.0.0.1:${port}`,
  networkInterfaces = os.networkInterfaces()
}) {
  const lanAddress = pickPreferredLanAddress(networkInterfaces);
  const resolvedPublicBaseUrl =
    publicBaseUrl ??
    (canExposeToLan(listenHost) && lanAddress ? `http://${lanAddress}:${port}` : localBaseUrl);
  const phoneAccessUrl = isLoopbackUrl(resolvedPublicBaseUrl) ? null : resolvedPublicBaseUrl;

  return {
    localBaseUrl,
    publicBaseUrl: resolvedPublicBaseUrl,
    phoneAccessUrl,
    isLocalOnly: !phoneAccessUrl,
    hint: phoneAccessUrl
      ? "请让 iPhone 和 Mac 连接到同一网络，再在手机上打开这个地址。"
      : "当前地址只在这台 Mac 上可用。要让手机接入，需要把中继暴露到同一局域网。"
  };
}

export function pickPreferredLanAddress(networkInterfaces = os.networkInterfaces()) {
  const addresses = Object.values(networkInterfaces)
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry?.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address)
    .filter(Boolean);

  if (addresses.length === 0) {
    return null;
  }

  return addresses
    .map((address) => ({
      address,
      score: scoreAddress(address)
    }))
    .sort((left, right) => right.score - left.score)[0].address;
}

function scoreAddress(address) {
  if (address.startsWith("192.168.")) {
    return 4;
  }

  if (address.startsWith("10.")) {
    return 3;
  }

  const match = address.match(/^172\.(\d{1,3})\./);
  if (match) {
    const secondOctet = Number(match[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return 2;
    }
  }

  return 1;
}

function canExposeToLan(host) {
  return host === "0.0.0.0" || host === "::" || host === "::0" || !isLoopbackHost(host);
}

function isLoopbackUrl(value) {
  try {
    return isLoopbackHost(new URL(value).hostname);
  } catch {
    return false;
  }
}

function isLoopbackHost(hostname) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}
