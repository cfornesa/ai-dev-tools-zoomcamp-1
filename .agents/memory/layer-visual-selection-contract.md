# Layer/visual selection contract

The editor's layer outline and Visual canvas must present one synchronized
selection state. A layer row is the entire block containing its name,
visibility/lock controls, disclosure/actions, and descendant outline content;
when one of its shapes is selected, that whole owning-layer block must carry
the selected treatment, not only a child row or a subregion. Selecting a
layer must also select its associated selectable shape when one exists; empty
layers remain layer-selectable without inventing a shape selection.

Keep the selection contract explicit in the scene-editor state and test both
directions in a real browser. Do not infer ownership only from CSS or from a
sub-button click, and do not let visibility/lock controls suppress the row's
selection synchronization.
