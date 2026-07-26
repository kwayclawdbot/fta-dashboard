import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// h264 mp4, good quality/size tradeoff for short social clips
Config.setCodec("h264");
Config.setCrf(23);
// Use the system Chrome instead of downloading Remotion's headless shell
// (the download endpoint was unreachable in this environment).
Config.setBrowserExecutable("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
