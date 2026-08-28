# Protocol research acknowledgements

R6 Monitor is an independent implementation built on Apple's public ImageCaptureCore API. Canon vendor-specific PTP identifiers and EVF container behavior were cross-checked against these open-source projects:

- [PTPPT](https://github.com/watr/PTPPT) — Swift/ImageCaptureCore PTP transport patterns, MIT License.
- [libgphoto2](https://github.com/gphoto/libgphoto2) — mature Canon EOS PTP operation research, GNU LGPL 2.1 or later.
- [ZENCHE](https://github.com/Tauber01/ZENCHE) — Canon live-view property and EVF block documentation, MIT License.
- [open-eos-control](https://github.com/js051/open-eos-control) — Canon USB/PTP live-view behavior documented from its Android implementation, Apache License 2.0.

No source code from libgphoto2 or other GPL/LGPL implementations is copied into this repository. No Canon SDK headers, binaries, confidential documentation, or firmware are distributed. The names Canon and EOS are trademarks of their respective owner. This project is not affiliated with or endorsed by Canon Inc.
