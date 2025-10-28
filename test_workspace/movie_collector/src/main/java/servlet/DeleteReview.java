package servlet;

import java.io.IOException;

import javax.servlet.RequestDispatcher;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import dao.MovieDAO;
import model.Review;

/**
 * Servlet implementation class InsertReview
 */
@WebServlet("/delete.do")
public class DeleteReview extends HttpServlet {
	private static final long serialVersionUID = 1L;

	protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		deleteReview(request, response);
	}

	protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		deleteReview(request, response);
	}

	protected void deleteReview(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		MovieDAO dao = new MovieDAO();
		HttpSession session = request.getSession();
		String reviewid = request.getParameter("reviewId");
		dao.deleteReview(reviewid);
//		response.sendRedirect("movieDetail.jsp?movieCd=" + session.getAttribute("movieCd"));
				RequestDispatcher dis = request.getRequestDispatcher("movieDetail.do?movieCd=" + session.getAttribute("movieCd"));
				dis.forward(request, response);
	};
}
