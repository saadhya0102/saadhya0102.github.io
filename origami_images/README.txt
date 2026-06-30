Drop origami photos and crease patterns here.

For each model in origami.json:
- "image"         : the finished-model photo (front of the card). Square-ish works best.
- "creasePattern" : the crease pattern shown when the card flips (back of the card).
- "angles"        : optional array of extra photos shown in the lightbox.

A filename with no folder is automatically resolved to origami_images/<filename>,
e.g. "image": "crane.jpg" -> origami_images/crane.jpg.

If an image is empty or missing, a styled paper placeholder is shown automatically
(finished side = soft paper, crease side = a generated crease-line pattern).
