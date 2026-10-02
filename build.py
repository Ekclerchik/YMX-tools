import zipfile
import os
import shutil

BASE = os.path.dirname(os.path.abspath(__file__))
ZIP = os.path.join(BASE, 'Y-Music-Tools.zip')
TEMP = r'C:\temp\yb_build'

def clean(path):
    if os.path.exists(path):
        shutil.rmtree(path)
    os.makedirs(path, exist_ok=True)

def zip_dir(src_dir, zip_path, arc_prefix):
    zf = zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9)
    for root, dirs, files in os.walk(src_dir):
        for f in files:
            full = os.path.join(root, f)
            arc = os.path.join(arc_prefix, os.path.relpath(full, src_dir)).replace('\\', '/')
            zf.write(full, arc)
    zf.close()

def write_zip(src_dir, zip_path, arc_prefix):
    # Собираем во временный файл: запуск zipfile прямо на существующем архиве
    # падает с OSError [Errno 22], если файл удерживает другой процесс
    # (about:debugging, архиватор, синхронизация) — он не даёт открыть его на
    # усечение, хотя на чтение и дописывание файл открывается свободно.
    tmp_path = zip_path + '.tmp'
    if os.path.exists(tmp_path):
        os.remove(tmp_path)
    zip_dir(src_dir, tmp_path, arc_prefix)
    os.replace(tmp_path, zip_path)

def build_firefox():
    print('[+] Building Firefox extension...')
    src = os.path.join(TEMP, 'firefox')
    clean(src)
    shutil.copy(os.path.join(BASE, 'manifest.json'), src)
    shutil.copytree(os.path.join(BASE, '_locales'), os.path.join(src, '_locales'), dirs_exist_ok=True)
    shutil.copytree(os.path.join(BASE, 'icon'), os.path.join(src, 'icon'), dirs_exist_ok=True, ignore=shutil.ignore_patterns('Image*.png'))
    shutil.copytree(os.path.join(BASE, 'src'), os.path.join(src, 'src'), dirs_exist_ok=True)
    write_zip(src, ZIP, '')
    print('[+] Firefox: {} ({} bytes)'.format(ZIP, os.path.getsize(ZIP)))

def main():
    clean(TEMP)
    build_firefox()
    clean(TEMP)
    print('[+] Done.')

if __name__ == '__main__':
    main()
