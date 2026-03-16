import json
import os
import re
import shutil

# Optional dependencies: fallback if unavailable

ImageGrab = None
PIL_AVAILABLE = False

pyperclip = None
PYPERCLIP_AVAILABLE = False

BOOK_FILE = "books.json"
IMAGE_DIR = "images"

def load_books():
    if not os.path.exists(BOOK_FILE):
        return []
    with open(BOOK_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_books(books):
    with open(BOOK_FILE, "w", encoding="utf-8") as f:
        json.dump(books, f, indent=2, ensure_ascii=False)

def sanitize_filename(name):
    return re.sub(r'[^\w\- ]', '', name).replace(" ", "_")

def list_books(books):
    for i in range(len(books)):
        b = books[i]
        print(f"{i + 1}. {b['title']} by {b['author']}")

def next_id(books):
    if not books:
        return "1"
    return str(max(int(b["id"]) for b in books) + 1)

def handle_image(title):
    print("\nImage options:")
    if PIL_AVAILABLE:
        print("1. Paste image (Ctrl+C image then press enter)")
    else:
        print("1. Paste image (unavailable: PIL/Pillow not installed)")
    print("2. Type image path")
    print("3. No image")

    choice = input("> ").strip()

    if choice == "1":
        if not PIL_AVAILABLE or ImageGrab is None:
            print("Image paste is disabled because PIL/Pillow is not installed.")
            return ""

        img = ImageGrab.grabclipboard()
        if img is None:
            print("No image found in clipboard.")
            return ""

        name = sanitize_filename(title)

        ext = 'png'
        save_format = 'PNG'
        if getattr(img, 'format', None):
            fmt = img.format.lower()
            if fmt in ['jpeg', 'jpg']:
                ext = 'jpg'
                save_format = 'JPEG'
            elif fmt == 'png':
                ext = 'png'
                save_format = 'PNG'
            elif fmt == 'bmp':
                ext = 'bmp'
                save_format = 'BMP'

        path = os.path.join(IMAGE_DIR, f"{name}.{ext}")

        os.makedirs(IMAGE_DIR, exist_ok=True)
        img.save(path, format=save_format)

        print("Saved image to", path)
        return path.replace('\\', '/')

    elif choice == "2":
        input_path = input("Enter image path: ").strip()
        if not input_path:
            return ""

        if not os.path.exists(input_path):
            print("File not found.")
            return ""

        ext = os.path.splitext(input_path)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.bmp', '.gif']:
            print("Unsupported image type. Use JPG/JPEG/PNG/BMP/GIF")
            return ""

        os.makedirs(IMAGE_DIR, exist_ok=True)
        target_name = sanitize_filename(title) + ext
        target_path = os.path.join(IMAGE_DIR, target_name)

        try:
            shutil.copy2(input_path, target_path)
            print("Copied image to", target_path)
            return target_path.replace('\\', '/')
        except Exception as e:
            print("Failed to copy image:", e)
            return ""

    return ""

def add_book(books):
    title = input("Title: ")
    author = input("Author: ")
    rating = float(input("Rating: "))
    date = input("Date read (YYYY-MM-DD): ")
    tags = input("Tags (comma separated): ").split(",")
    synopsis = input("Synopsis: ")
    review = input("Review: ")
    image = handle_image(title)

    book = {
        "id": next_id(books),
        "title": title,
        "author": author,
        "image": image,
        "overallRating": rating,
        "dateRead": date,
        "tags": [t.strip() for t in tags],
        "synopsis": synopsis,
        "review": review
    }

    books.append(book)
    save_books(books)

    print("Book added.")

def find_book(books, title):
    for b in books:
        if b["title"].lower() == title.lower():
            return b
    return None

def edit_book(books):

    title = input("Enter title: ")

    book = find_book(books, title)

    if not book:
        print("Book not found.")
        return

    fields = list(book.keys())

    print("\nEditable fields:")
    for i, f in enumerate(fields):
        print(i, f)

    idx = int(input("Choose field: "))

    field = fields[idx]

    print("Current value:", book[field])

    if field == "image":
        book[field] = handle_image(book["title"])
    elif field == "tags":
        book[field] = input("New tags (comma separated): ").split(",")
    elif field in ["overallRating"]:
        book[field] = float(input("New value: "))
    else:
        book[field] = input("New value: ")

    save_books(books)

    print("Updated.")

def delete_book(books):

    title = input("Enter title to delete: ")

    book = find_book(books, title)

    if not book:
        print("Not found.")
        return

    books.remove(book)

    save_books(books)

    print("Deleted.")

def main():

    books = load_books()

    while True:

        print("\nCommands:")
        print("1 list")
        print("2 add")
        print("3 edit")
        print("4 delete")
        print("5 quit")

        cmd = input("> ").strip()

        if cmd == "1":
            list_books(books)

        elif cmd == "2":
            add_book(books)
            books = load_books()

        elif cmd == "3":
            edit_book(books)
            books = load_books()

        elif cmd == "4":
            delete_book(books)
            books = load_books()

        elif cmd == "5":
            break


if __name__ == "__main__":
    main()