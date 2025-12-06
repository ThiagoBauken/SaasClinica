import os
import uuid
import sqlite3
from flask import Flask, request, redirect, url_for, send_from_directory, render_template, jsonify, session, g
from werkzeug.utils import secure_filename
from py import process_uploaded_files, parse_gpt_output, save_to_excel
from functools import wraps

UPLOAD_FOLDER = 'uploads'
PROCESSED_FOLDER = 'processed'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'tiff'}

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['PROCESSED_FOLDER'] = PROCESSED_FOLDER
app.secret_key = 'your_secret_key'  # Secret key for session management
DATABASE = 'database.db'
ACCESS_PASSWORD = 'Thiago666'  # The password to access the site

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

if not os.path.exists(PROCESSED_FOLDER):
    os.makedirs(PROCESSED_FOLDER)

# Function to check if the uploaded file has an allowed extension
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Database connection
def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def query_db(query, args=(), one=False):
    cur = get_db().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv

def init_db():
    with app.app_context():
        db = get_db()
        db.executescript('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            );
        ''')
        db.commit()

# Authentication decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('authenticated'):
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/password', methods=['GET', 'POST'])
def password():
    if request.method == 'POST':
        entered_password = request.form['password']
        if entered_password == ACCESS_PASSWORD:
            session['access_granted'] = True
            return redirect(url_for('login'))
        else:
            return render_template('password.html', error="Incorrect password.")
    return render_template('password.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        db = get_db()
        try:
            db.execute('INSERT INTO users (username, password) VALUES (?, ?)', (username, password))
            db.commit()
            return redirect(url_for('login'))
        except sqlite3.IntegrityError:
            return render_template('register.html', error="Username already exists.")
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'access_granted' not in session or not session['access_granted']:
        return redirect(url_for('password'))

    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = query_db('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], one=True)
        if user:
            session['authenticated'] = True
            session['user_id'] = user[0]
            session['username'] = user[1]
            return redirect(url_for('upload_file'))
        else:
            return render_template('login.html', error="Invalid username or password.")
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/', methods=['GET', 'POST'])
@login_required
def upload_file():
    if request.method == 'POST':
        output_format = request.form.get('format')
        
        if not output_format:
            return render_template('upload.html', error="Please select an output format.")
        
        file_extension = output_format.lower()
        if file_extension not in ['xlsx', 'csv', 'pdf', 'json']:
            return render_template('upload.html', error="Invalid output format selected.")
        
        if 'file' not in request.files or not request.files.getlist('file'):
            return render_template('upload.html', error="Please select at least one file.")

        files = request.files.getlist('file')
        session_id = os.urandom(16).hex()
        session_upload_dir = os.path.join(app.config['UPLOAD_FOLDER'], session_id)
        os.makedirs(session_upload_dir)

        all_data = []  # List to store data from all images

        for file in files:
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                file_path = os.path.join(session_upload_dir, filename)
                file.save(file_path)

        # Process the uploaded files directory
        output_file = os.path.join(app.config['PROCESSED_FOLDER'], f'{session_id}.{file_extension}')
        processed_file_path = process_uploaded_files(session_upload_dir, None, output_file)

        if processed_file_path and os.path.exists(processed_file_path):
            db = get_db()
            db.execute('INSERT INTO files (user_id, filename) VALUES (?, ?)', (session['user_id'], os.path.basename(processed_file_path)))
            db.commit()
            return jsonify({
                'download_url': url_for('download_file', filename=os.path.basename(processed_file_path)),
                'filename': os.path.basename(processed_file_path)
            })
        else:
            return jsonify({'error': "Failed to save the file."})

    return render_template('upload.html')

@app.route('/history', methods=['GET'])
@login_required
def history():
    files = query_db('SELECT filename FROM files WHERE user_id = ?', [session['user_id']])
    return render_template('history.html', files=files)

@app.route('/delete_file/<filename>', methods=['POST'])
@login_required
def delete_file(filename):
    try:
        # Construct the file path
        file_path = os.path.join(app.config['PROCESSED_FOLDER'], filename)
        
        # Check if file exists
        if os.path.exists(file_path):
            os.remove(file_path)  # Delete the file from the file system
            
            # Remove the file entry from the database
            db = get_db()
            db.execute('DELETE FROM files WHERE user_id = ? AND filename = ?', (session['user_id'], filename))
            db.commit()
            
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        print(f"[ERROR] An error occurred while trying to delete the file: {str(e)}")
        return jsonify({'error': 'An error occurred while trying to delete the file.'}), 500

@app.route('/processed/<filename>')
@login_required
def download_file(filename):
    path = os.path.join(app.config['PROCESSED_FOLDER'], filename)
    if os.path.exists(path):
        return send_from_directory(app.config['PROCESSED_FOLDER'], filename)
    else:
        return "File not found.", 404

if __name__ == "__main__":
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
