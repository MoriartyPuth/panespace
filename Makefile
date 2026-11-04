UUID = panespace@MoriartyPuth.github.io
ZIP  = $(UUID).shell-extension.zip

.PHONY: all pack install clean

all: pack

pack:
	gnome-extensions pack --force \
		--extra-source=lib \
		--out-dir=.
	@echo "Built $(ZIP)"

install: pack
	gnome-extensions install --force $(ZIP)
	@echo "Installed. Log out and back in, then enable Panespace."

clean:
	rm -f $(ZIP)
