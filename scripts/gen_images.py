"""
Generate Fairchild Alchemy product source art with FLUX, then render cards.

Outputs source images to public/images/thumb-sources/{product-id}-{a|b}.png.
Run from the repo root:
    python scripts/gen_images.py
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

from gradio_client import Client


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "fairchild.json"
SOURCE_DIR = ROOT / "public" / "images" / "thumb-sources"
MAKE_THUMBS = ROOT / "scripts" / "make_thumbs.py"
SPACE = "black-forest-labs/FLUX.1-schnell"


STYLE_SUFFIX = (
    " Premium ecommerce product photograph for Fairchild Alchemy. "
    "Modern alchemy storefront styling: graphite stone, living greenery, brushed metal, "
    "glass, ceramic, soft technical light, and authentic adult desk or shelf merchandise. "
    "Avoid steampunk, gothic props, sepia antiques, heavy brown wood, and period-piece styling. "
    "Centered product, vertical ecommerce product crop, realistic scale, clean negative space. "
    "No text, no logos, no watermark, no hands, no people."
)


def load_products():
    with DATA_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    products = []
    for category in data.get("categories", []):
        for item in category.get("items", []):
            seed_data = item.get("generation_seed") or {}
            prompt = seed_data.get("prompt")
            if not prompt:
                continue
            products.append(
                {
                    "id": item["id"],
                    "name": item["name"],
                    "seed": int(seed_data.get("seed") or 0),
                    "prompt": prompt,
                    "variants": seed_data.get("angle_variants") or [],
                }
            )
    return products


def prompt_for(product, index):
    if index == 0:
        return f"{product['prompt']}. {STYLE_SUFFIX}"
    variants = product["variants"]
    variant = variants[index - 1] if index - 1 < len(variants) else "alternate detail view"
    return f"{product['prompt']}. Variant: {variant}. {STYLE_SUFFIX}"


def result_path(result):
    if isinstance(result, dict) and result.get("path"):
        return Path(result["path"])
    raise RuntimeError(f"FLUX returned an unexpected image result: {result!r}")


def generate_one(client, product, suffix, index, force=False):
    out_path = SOURCE_DIR / f"{product['id']}-{suffix}.png"
    if out_path.exists() and not force:
        print(f"  [skip] {out_path.name} already exists")
        return False

    seed = product["seed"] + index
    prompt = prompt_for(product, index)
    print(f"  Generating {out_path.name}...")
    result, used_seed = client.predict(
        prompt=prompt,
        seed=seed,
        randomize_seed=False,
        width=1024,
        height=1280,
        num_inference_steps=4,
        api_name="/infer",
    )
    tmp_path = result_path(result)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(tmp_path, out_path)
    print(f"    saved {out_path.name} seed={int(used_seed)}")
    return True


def render_cards():
    print("\nRendering product cards from source assets...")
    subprocess.run([sys.executable, str(MAKE_THUMBS)], cwd=str(ROOT), check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="Maximum number of source images to generate")
    parser.add_argument("--force", action="store_true", help="Regenerate source assets even when files exist")
    parser.add_argument("--no-render", action="store_true", help="Only generate source assets")
    args = parser.parse_args()

    products = load_products()
    total = len(products) * 2
    print(f"Connecting to FLUX space: {SPACE}")
    client = Client(SPACE)
    print(f"Connected. {total} source images available.\n")

    attempted = 0
    generated = 0
    for product in products:
        for index, suffix in enumerate(("a", "b")):
            if args.limit is not None and attempted >= args.limit:
                break
            attempted += 1
            try:
                if generate_one(client, product, suffix, index, args.force):
                    generated += 1
            except Exception as e:
                print(f"  failed {product['id']}-{suffix}.png: {e}")
        if args.limit is not None and attempted >= args.limit:
            break

    print(f"\nGeneration complete. Generated {generated} new source image(s).")
    if generated and not args.no_render:
        render_cards()
    elif not generated:
        print("No new source images generated, so card rendering was skipped.")


if __name__ == "__main__":
    main()
